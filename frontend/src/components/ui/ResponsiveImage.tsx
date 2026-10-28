import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface ResponsiveImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  renditions?: Record<string, string>;
  alt: string;
  sizes?: string;
  priority?: boolean;
}

/** WebP srcset from server renditions, lazy by default, with a soft fade-in on load. */
export function ResponsiveImage({ src, renditions, alt, sizes = '100vw', priority, className, ...rest }: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const entries = Object.entries(renditions ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const srcSet = entries.map(([w, url]) => `${url} ${w}w`).join(', ');
  const fallback = entries.length ? entries[Math.min(1, entries.length - 1)][1] : src;
  return (
    <img
      src={fallback}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...{ fetchpriority: priority ? 'high' : 'auto' }}
      onLoad={() => setLoaded(true)}
      className={cn('transition-opacity duration-700 ease-luxe', loaded || priority ? 'opacity-100' : 'opacity-0', className)}
      {...rest}
    />
  );
}
