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
      // Dark-text slides sit on a light scrim: keep their light colours (text, controls) in dark mode.
      data-light-surface={light ? undefined : ''}
      className="relative isolate h-[100svh] min-h-[38rem] overflow-hidden bg-shade"
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
              // Text sits at the bottom, so the scrim rises from there; a light veil at the top keeps the nav legible.
              light
                ? 'bg-gradient-to-t from-shade/85 via-shade/35 to-shade/15'
                : 'bg-gradient-to-t from-paper-50/95 via-paper-50/55 to-paper-50/20',
            )}
          />
        </motion.div>
      </AnimatePresence>

      <div className="container-page relative z-[2] flex h-full items-end pb-28 md:pb-32">
        <div
          key={slide.id}
          ref={textRef}
          className={cn(
            'max-w-6xl',
            slide.text_align === 'center' && 'mx-auto text-center',
            slide.text_align === 'right' && 'ml-auto text-right',
          )}
          aria-live={running ? 'off' : 'polite'}
        >
          {slide.eyebrow ? (
            <p data-eyebrow className={cn('text-sm font-medium', light ? 'text-white/75' : 'text-ink-soft')}>
              {slide.eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              'mt-4 text-balance text-[clamp(3rem,1.6rem+7vw,9.5rem)] font-semibold leading-[0.9] tracking-[-0.055em]',
              light ? 'text-white' : 'text-ink',
            )}
          >
            <Words text={slide.headline} />
          </h1>
          {slide.subtext ? (
            <p data-sub className={cn('mt-6 max-w-md text-base md:text-lg', light ? 'text-white/80' : 'text-ink-soft', slide.text_align === 'center' && 'mx-auto')}>
              {slide.subtext}
            </p>
          ) : null}
          <div className={cn('mt-8 flex flex-wrap gap-3', slide.text_align === 'center' && 'justify-center')}>
            {slide.cta_label ? (
              <Link data-cta to={slide.cta_url} className={buttonClasses({ size: 'lg', variant: light ? 'inverse' : 'primary' })}>
                {slide.cta_label}
              </Link>
            ) : null}
            {slide.secondary_cta_label ? (
              <Link
                data-cta
                to={slide.secondary_cta_url}
                className={cn(
                  buttonClasses({ size: 'lg', variant: 'secondary' }),
                  light && 'border-white/40 bg-white/10 text-white backdrop-blur hover:border-white hover:bg-white hover:text-[#0a0a0a]',
                )}
              >
                {slide.secondary_cta_label}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {count > 1 ? (
        <div className="container-page absolute inset-x-0 bottom-6 z-[3] flex items-center gap-5 md:bottom-10">
          <p className={cn('text-sm tabular-nums', light ? 'text-white/80' : 'text-ink-soft')} aria-hidden="true">
            {String(index + 1).padStart(2, '0')} <span className="opacity-50">/ {String(count).padStart(2, '0')}</span>
          </p>
          <div className="flex flex-1 gap-2" role="group" aria-label="Choose slide">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${s.headline}`}
                aria-current={i === index}
                className="group relative h-11 min-w-6 flex-1 max-w-24"
              >
                <span className={cn('absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full', light ? 'bg-paper-50/30' : 'bg-ink/20')}>
                  {i === index ? (
                    <motion.span
                      key={`${index}-${running}`}
                      className={cn('block h-full origin-left', light ? 'bg-white' : 'bg-ink')}
                      initial={{ scaleX: running ? 0 : 1 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: running ? INTERVAL / 1000 : 0, ease: 'linear' }}
                    />
                  ) : (
                    <span className={cn('block h-full transition-transform', light ? 'bg-paper-50/70' : 'bg-ink/50', i < index ? 'scale-x-100' : 'scale-x-0')} />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className={cn('flex gap-1', light ? 'text-paper-50' : 'text-ink')}>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full', light ? 'hover:bg-paper-50/10' : 'hover:bg-ink/5')}>
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full border', light ? 'border-paper-50/30 hover:bg-paper-50/10' : 'border-ink/25 hover:bg-ink/5')}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full border', light ? 'border-paper-50/30 hover:bg-paper-50/10' : 'border-ink/25 hover:bg-ink/5')}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
