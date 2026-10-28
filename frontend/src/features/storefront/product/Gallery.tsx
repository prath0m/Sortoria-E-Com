import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/zoom';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, Pagination, Zoom } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper/types';
import type { ProductImage } from '@/api/types';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { cn } from '@/lib/cn';
import { useFocusTrap, useIsDesktop, useScrollLock } from '@/lib/hooks';

const largest = (img: ProductImage) => {
  const keys = Object.keys(img.renditions).map(Number).sort((a, b) => b - a);
  return keys.length ? img.renditions[String(keys[0])] : img.url;
};

/** Desktop: thumbnails + hover zoom lens. Mobile: swipe with dots. Both open a full-screen pinch-zoom viewer. */
export function Gallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const desktop = useIsDesktop();
  const current = images[Math.min(index, images.length - 1)];

  if (!images.length) return <div className="aspect-[4/5] rounded-sm bg-cream-200" />;

  return (
    <div className="min-w-0">
      {desktop ? (
        <div className="grid grid-cols-[4.5rem_1fr] gap-4">
          <ul className="flex flex-col gap-3" aria-label="Product images">
            {images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-current={i === index}
                  className={cn(
                    'block aspect-[4/5] w-full overflow-hidden rounded-xs ring-1 ring-line transition-shadow',
                    i === index && 'ring-2 ring-burgundy-800',
                  )}
                >
                  <ResponsiveImage src={img.url} renditions={img.renditions} alt="" sizes="72px" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <HoverZoom image={current} priority onOpen={() => setFullscreen(true)} />
        </div>
      ) : (
        <div className="relative -mx-4 sm:mx-0">
          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            onSlideChange={(s) => setIndex(s.activeIndex)}
            className="gallery-swiper"
          >
            {images.map((img, i) => (
              <SwiperSlide key={img.id}>
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  className="block aspect-[4/5] w-full bg-cream-200"
                  aria-label={`Open image ${i + 1} full screen`}
                >
                  <ResponsiveImage
                    src={img.url}
                    renditions={img.renditions}
                    alt={img.alt}
                    sizes="100vw"
                    priority={i === 0}
                    className="h-full w-full object-cover"
                  />
                </button>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
      <AnimatePresence>
        {fullscreen ? (
          <Lightbox images={images} start={index} name={name} onClose={() => setFullscreen(false)} onIndex={setIndex} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HoverZoom({ image, priority, onOpen }: { image: ProductImage; priority?: boolean; onOpen: () => void }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const move = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    setZoom({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      onMouseMove={move}
      onMouseLeave={() => setZoom(null)}
      aria-label="Open full-screen view"
      className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden rounded-sm bg-cream-200"
    >
      <ResponsiveImage
        key={image.id}
        src={image.url}
        renditions={image.renditions}
        alt={image.alt}
        sizes="(min-width: 1280px) 46vw, 55vw"
        priority={priority}
        className="h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 bg-no-repeat transition-opacity duration-250', zoom ? 'opacity-100' : 'opacity-0')}
        style={{
          backgroundImage: `url(${largest(image)})`,
          backgroundSize: '220%',
          backgroundPosition: zoom ? `${zoom.x}% ${zoom.y}%` : 'center',
        }}
      />
      <span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-surface-raised/90 px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink shadow-soft backdrop-blur transition-opacity group-hover:opacity-0">
        <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" /> Hover to zoom
      </span>
      <Expand className="absolute right-4 top-4 h-5 w-5 text-ink/60" aria-hidden="true" />
    </button>
  );
}

function Lightbox({
  images,
  start,
  name,
  onClose,
  onIndex,
}: {
  images: ProductImage[];
  start: number;
  name: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [active, setActive] = useState(start);
  useFocusTrap(ref, true, onClose);
  useScrollLock(true);

  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} images`}
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-modal flex flex-col bg-surface-raised"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {active + 1} / {images.length} · Pinch or double-tap to zoom
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <Swiper
          modules={[Zoom, Keyboard]}
          zoom={{ maxRatio: 3 }}
          keyboard
          initialSlide={start}
          onSwiper={setSwiper}
          onSlideChange={(s) => {
            setActive(s.activeIndex);
            onIndex(s.activeIndex);
          }}
          className="h-full"
        >
          {images.map((img) => (
            <SwiperSlide key={img.id}>
              <div className="swiper-zoom-container h-full">
                <img src={largest(img)} alt={img.alt} className="max-h-full max-w-full object-contain" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => swiper?.slidePrev()}
              aria-label="Previous image"
              className="absolute left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised shadow-soft md:inline-flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => swiper?.slideNext()}
              aria-label="Next image"
              className="absolute right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised shadow-soft md:inline-flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
    </motion.div>,
    document.body,
  );
}
