import { Award, Gift, Leaf, MessageCircle, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';

const ICONS = { truck: Truck, return: RotateCcw, shield: ShieldCheck, chat: MessageCircle, gift: Gift, leaf: Leaf, award: Award };

export function TrustBadges({ badges }: { badges: { icon: string; title: string; text: string }[] }) {
  return (
    <section aria-label="Why shop with us" className="border-b border-line bg-paper-50">
      <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4">
        {badges.map((b, i) => {
          const Icon = ICONS[b.icon as keyof typeof ICONS] ?? Award;
          return (
            <Reveal as="li" key={b.title} delay={i * 0.08} className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-iris-400/60 text-charcoal-800">
                <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{b.title}</span>
                {b.text ? <span className="mt-0.5 block text-[0.8125rem] leading-snug text-ink-muted">{b.text}</span> : null}
              </span>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
