import { Check, Link2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function ShareMenu({ title, image }: { title: string; image?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const enc = encodeURIComponent;
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: 'Pinterest', href: `https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(title)}${image ? `&media=${enc(new URL(image, url).toString())}` : ''}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'X', href: `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}` },
  ];

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      /* the shopper dismissed the share sheet */
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied');
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-[0.12em] text-ink-muted text-[0.6875rem]">
        <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
      </span>
      {typeof navigator !== 'undefined' && 'share' in navigator ? (
        <button type="button" onClick={nativeShare} className="link-underline text-ink-soft hover:text-ink md:hidden">
          Share…
        </button>
      ) : null}
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noreferrer noopener" className="link-underline hidden text-ink-soft hover:text-ink md:inline">
          {l.label}
        </a>
      ))}
      <button type="button" onClick={copy} className="link-underline inline-flex items-center gap-1 text-ink-soft hover:text-ink">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} Copy link
      </button>
    </div>
  );
}
