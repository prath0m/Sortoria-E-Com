import { Facebook, Instagram, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFooterPages } from '@/api/hooks/cms';
import { useNavigation, useStoreSettings } from '@/api/hooks/store';
import { NewsletterForm } from '../home/sections/Newsletter';
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
      <h2 className="mb-5 font-sans text-sm font-semibold text-white">{title}</h2>
      <ul className="space-y-3 text-sm text-white/65">{children}</ul>
    </div>
  );
}

export function Footer() {
  const { data: store } = useStoreSettings();
  const { data: categories = [] } = useNavigation();
  const { data: pages = [] } = useFooterPages();
  const name = store?.name ?? 'Sartoria';
  const socials = [
    { href: store?.instagram_url, label: 'Instagram', Icon: Instagram },
    { href: store?.facebook_url, label: 'Facebook', Icon: Facebook },
    { href: store?.pinterest_url, label: 'Pinterest', Icon: Pinterest },
    { href: store?.youtube_url, label: 'YouTube', Icon: Youtube },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 rounded-t-[2rem] bg-[#0a0a0a] text-white">
      <div className="container-page relative z-[2] py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm">
                        {store?.footer_blurb ? <p className="mt-6 text-sm leading-relaxed text-white/65">{store.footer_blurb}</p> : null}
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-white">The {name} letter</p>
              <NewsletterForm source="footer" tone="dark" compact />
            </div>
            {socials.length ? (
              <ul className="mt-8 flex gap-2">
                {socials.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${name} on ${label}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white hover:text-white"
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
                  <Link to={`/shop/${c.slug}`} className="link-underline hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn title="Help">
              <li><Link to="/track-order" className="link-underline hover:text-white">Track your order</Link></li>
              <li><Link to="/offers" className="link-underline hover:text-white">Offers</Link></li>
              {store?.contact_email ? (
                <li>
                  <a href={`mailto:${store.contact_email}`} className="link-underline hover:text-white">
                    {store.contact_email}
                  </a>
                </li>
              ) : null}
              {store?.support_phone ? <li className="text-white/65">{store.support_phone}</li> : null}
            </FooterColumn>
            <FooterColumn title={name}>
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link to={`/pages/${page.slug}`} className="link-underline hover:text-white">
                    {page.title}
                  </Link>
                </li>
              ))}
            </FooterColumn>
          </div>
        </div>
        {/* The wordmark set edge to edge: the page signs off. */}
        <Logo src={store?.logo} label={name} tone="light" className="mt-16 h-auto w-full lg:mt-24" />
        <div className="mt-10 flex flex-col gap-3 border-t border-white/15 pt-6 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
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
