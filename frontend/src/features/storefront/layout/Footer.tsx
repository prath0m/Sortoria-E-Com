import { Facebook, Instagram, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import { Logo } from '@/components/brand/Logo';
import type { ReactNode } from 'react';

function Pinterest(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.6-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.5-.3 1.1.5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.6-1.8-4.4-4.5-4.4-3 0-4.8 2.3-4.8 4.6 0 .9.4 1.9.8 2.4l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.4-.6-2.2-2.6-2.2-4.2 0-3.4 2.5-6.6 7.2-6.6 3.8 0 6.7 2.7 6.7 6.3 0 3.8-2.4 6.8-5.7 6.8-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.2 1-.9 2.2-1.4 2.9A10 10 0 1 0 12 2z" />
    </svg>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-gold-300">{title}</h2>
      <ul className="space-y-3 text-sm text-cream-200">{children}</ul>
    </div>
  );
}

export function Footer() {
  const { data: store } = useStoreSettings();
  const { data: categories = [] } = useNavigation();
  const name = store?.name ?? 'Sartoria';
  const socials = [
    { href: store?.instagram_url, label: 'Instagram', Icon: Instagram },
    { href: store?.facebook_url, label: 'Facebook', Icon: Facebook },
    { href: store?.pinterest_url, label: 'Pinterest', Icon: Pinterest },
    { href: store?.youtube_url, label: 'YouTube', Icon: Youtube },
  ].filter((s) => s.href);

  return (
    <footer className="grain mt-24 bg-burgundy-900 text-cream-100">
      <div className="container-page relative z-[2] py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
            <Logo src={store?.logo} label={name} tone="cream" className="h-8" />
            {store?.footer_blurb ? <p className="mt-6 text-sm leading-relaxed text-cream-200">{store.footer_blurb}</p> : null}
            {socials.length ? (
              <ul className="mt-8 flex gap-2">
                {socials.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${name} on ${label}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream-100/25 text-cream-100 transition-colors hover:border-gold-300 hover:text-gold-300"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterColumn title="Shop">
              {categories.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to={`/shop/${c.slug}`} className="link-underline hover:text-cream-50">
                    {c.name}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn title="Help">
              <li><Link to="/track-order" className="link-underline hover:text-cream-50">Track your order</Link></li>
              <li><Link to="/pages/shipping-policy" className="link-underline hover:text-cream-50">Shipping</Link></li>
              <li><Link to="/pages/returns-policy" className="link-underline hover:text-cream-50">Returns &amp; refunds</Link></li>
              <li><Link to="/pages/contact" className="link-underline hover:text-cream-50">Contact us</Link></li>
            </FooterColumn>
            <FooterColumn title={name}>
              <li><Link to="/pages/about" className="link-underline hover:text-cream-50">Our story</Link></li>
              <li><Link to="/pages/privacy-policy" className="link-underline hover:text-cream-50">Privacy</Link></li>
              <li><Link to="/pages/terms" className="link-underline hover:text-cream-50">Terms</Link></li>
              {store?.contact_email ? (
                <li>
                  <a href={`mailto:${store.contact_email}`} className="link-underline hover:text-cream-50">
                    {store.contact_email}
                  </a>
                </li>
              ) : null}
              {store?.support_phone ? <li className="text-cream-200">{store.support_phone}</li> : null}
            </FooterColumn>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-cream-100/15 pt-6 text-xs text-cream-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {name}. All prices include GST.
          </p>
          {store?.address_line1 ? (
            <p>
              {[store.address_line1, store.city, store.pincode].filter(Boolean).join(', ')}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
