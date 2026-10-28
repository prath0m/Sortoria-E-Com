import 'swiper/css';
import 'swiper/css/pagination';

import { Quote } from 'lucide-react';
import { A11y, Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Stars } from '@/components/ui/Rating';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { SectionHeading } from './SectionHeading';

type Item = { name: string; location: string; quote: string; rating: number; avatar: string | null };

export function Testimonials({ eyebrow, title, items }: { eyebrow: string; title: string; items: Item[] }) {
  const reduce = usePrefersReducedMotion();
  return (
    <section className="overflow-hidden bg-cream-200/50 py-16 lg:py-24">
      <div className="container-page">
        <SectionHeading eyebrow={eyebrow} title={title} center />
        <Swiper
          modules={[Autoplay, Pagination, A11y]}
          className="gallery-swiper !pb-12"
          spaceBetween={24}
          slidesPerView={1.1}
          breakpoints={{ 768: { slidesPerView: 2.1 }, 1280: { slidesPerView: 3 } }}
          autoplay={reduce ? false : { delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true }}
          pagination={{ clickable: true }}
          a11y={{ prevSlideMessage: 'Previous testimonial', nextSlideMessage: 'Next testimonial' }}
        >
          {items.map((t) => (
            <SwiperSlide key={t.name} className="!h-auto">
              <figure className="flex h-full flex-col rounded-sm border border-line bg-surface-raised p-7 shadow-soft">
                <Quote className="h-7 w-7 text-gold-500" aria-hidden="true" />
                <blockquote className="mt-4 flex-1 font-display text-xl leading-snug text-ink">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <span>
                    <span className="block font-semibold text-ink">{t.name}</span>
                    {t.location ? <span className="text-ink-muted">{t.location}</span> : null}
                  </span>
                  <Stars value={t.rating} />
                </figcaption>
              </figure>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
