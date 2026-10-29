import { BadgeCheck, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useReviews, useSubmitReview } from '@/api/hooks/reviews';
import type { Review } from '@/api/types';
import { Reveal } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Overlay';
import { PhotoPicker } from '@/components/ui/PhotoPicker';
import { Stars } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarInput } from '@/components/ui/StarInput';
import { cn } from '@/lib/cn';
import { useAuth } from '@/stores/auth';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function ReviewCard({ review }: { review: Review }) {
  return (
    <li className="border-b border-line py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating} />
        <span className="sr-only">{review.rating} out of 5 stars</span>
        <h4 className="font-sans text-[0.9375rem] font-semibold text-ink">{review.title}</h4>
      </div>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{review.body}</p>
      {review.photos.length ? (
        <ul className="mt-3 flex gap-2">
          {review.photos.map((src) => (
            <li key={src}>
              <a href={src} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-xs bg-paper-200">
                <img src={src} alt={`Shared by ${review.author}`} loading="lazy" className="h-full w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span>{review.author}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={review.created_at}>{dateFormat.format(new Date(review.created_at))}</time>
        {review.is_verified_buyer ? (
          <Badge tone="success">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified buyer
          </Badge>
        ) : null}
      </p>
      {review.admin_reply ? (
        <div className="mt-4 border-l-2 border-iris-400 bg-paper-200/60 px-4 py-3 text-sm text-ink-soft">
          <p className="mb-1 text-xs font-semibold text-charcoal-800">From Sartoria</p>
          {review.admin_reply}
        </div>
      ) : null}
    </li>
  );
}

function ReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const submit = useSubmitReview(slug);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-5 p-5 sm:p-6"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (!rating) next.rating = 'Please choose a rating.';
        if (!title.trim()) next.title = 'Give your review a short title.';
        if (body.trim().length < 20) next.body = 'Tell us a little more: at least 20 characters.';
        setErrors(next);
        if (Object.keys(next).length) return;
        const form = new FormData();
        form.append('rating', String(rating));
        form.append('title', title);
        form.append('body', body);
        photos.forEach((p) => form.append('photos', p));
        try {
          await submit.mutateAsync(form);
          toast.success('Thank you for your review', { description: 'It will appear once our team has read it.' });
          onDone();
        } catch (err) {
          if (err instanceof ApiError) {
            const fields = err.fieldErrors;
            setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])));
            if (!Object.keys(fields).length) toast.error(err.message);
          }
        }
      }}
    >
      <StarInput value={rating} onChange={setRating} error={errors.rating} />
      <TextField label="Title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="Sum it up in a few words" />
      <TextArea
        label="Your review"
        rows={5}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        error={errors.body}
        hint="How does it look, feel and perform? Would you recommend it?"
      />
      <PhotoPicker files={photos} onChange={setPhotos} max={3} label="Photos" hint="Optional, up to three." />
      <Button type="submit" loading={submit.isPending}>
        Submit review
      </Button>
    </form>
  );
}

export function ReviewsSection({ slug, productName }: { slug: string; productName: string }) {
  const [sort, setSort] = useState('newest');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Review[]>([]);
  const [writing, setWriting] = useState(false);
  const { data, isLoading, isFetching } = useReviews(slug, { sort, rating, page });
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const location = useLocation();

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [sort, rating, slug]);
  useEffect(() => {
    if (!data) return;
    setItems((prev) => (data.page === 1 ? data.results : [...prev, ...data.results.filter((r) => !prev.some((p) => p.id === r.id))]));
  }, [data]);

  const summary = data?.summary;
  const viewer = data?.viewer;
  const total = summary ? Object.values(summary.distribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="container-page scroll-mt-32 py-14 lg:py-20">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">In their words</p>
          <h2 id="reviews-heading" className="mt-2 text-display-lg">Reviews</h2>
        </div>
        {viewer?.status ? (
          <p className="text-sm text-ink-muted">
            {viewer.status === 'pending' ? 'Thank you, your review is awaiting approval.' : 'Thank you for reviewing this piece.'}
          </p>
        ) : signedIn ? (
          <Button variant="secondary" icon={<PenLine className="h-4 w-4" />} onClick={() => setWriting(true)}>
            Write a review
          </Button>
        ) : (
          <Link to={`/login?next=${encodeURIComponent(location.pathname + '#reviews')}`} className="text-sm font-semibold text-charcoal-800 link-underline">
            Sign in to write a review
          </Link>
        )}
      </Reveal>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !summary?.count ? (
        <p className="max-w-lg text-ink-soft">
          No reviews yet. If you own {productName}, we'd love to hear how you're finding it.
        </p>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[18rem_1fr]">
          <div>
            <p className="font-display text-display-xl text-ink">{summary.average.toFixed(1)}</p>
            <Stars value={summary.average} size={18} />
            <p className="mt-2 text-sm text-ink-muted">Based on {summary.count} {summary.count === 1 ? 'review' : 'reviews'}</p>
            <ul className="mt-6 space-y-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[String(n)] ?? 0;
                const active = rating === String(n);
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => setRating(active ? '' : String(n))}
                      aria-pressed={active}
                      disabled={!count}
                      className={cn('flex w-full items-center gap-3 rounded-xs px-1 py-0.5 text-sm disabled:opacity-40', active && 'bg-paper-200')}
                    >
                      <span className="w-6 text-ink-soft">{n}★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-300">
                        <span className="block h-full rounded-full bg-iris-400" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                      </span>
                      <span className="w-8 text-right text-ink-muted">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
              <p className="text-sm text-ink-muted" aria-live="polite">
                {rating ? `Showing ${rating}-star reviews` : `${data?.count ?? 0} reviews`}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-ink-muted">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 rounded-xs border border-line-strong bg-surface-raised px-2 text-sm focus:border-charcoal-800 focus:outline-none"
                >
                  <option value="newest">Newest</option>
                  <option value="highest">Highest rated</option>
                  <option value="lowest">Lowest rated</option>
                </select>
              </label>
            </div>
            <ul>
              {items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>
            {data?.next ? (
              <Button variant="secondary" className="mt-8" loading={isFetching} onClick={() => setPage((p) => p + 1)}>
                Show more reviews
              </Button>
            ) : null}
          </div>
        </div>
      )}
      <Modal open={writing} onClose={() => setWriting(false)} title={`Review ${productName}`} className="max-w-xl">
        <ReviewForm slug={slug} onDone={() => setWriting(false)} />
      </Modal>
    </section>
  );
}
