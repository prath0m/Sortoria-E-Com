import { CountUp } from '@/components/motion/CountUp';
import { Reveal } from '@/components/motion/Reveal';

export function Counters({ counters }: { counters: { value: number; prefix: string; suffix: string; label: string }[] }) {
  return (
    <section aria-label="Sartoria in numbers" className="container-page py-16 lg:py-24">
      <ul className="grid grid-cols-2 border-t border-line md:grid-cols-4">
        {counters.map((c, i) => (
          <Reveal
            as="li"
            key={c.label}
            delay={i * 0.08}
            className="flex min-h-[12rem] flex-col justify-between border-b border-line p-5 even:border-l md:min-h-[16rem] md:border-b-0 md:border-l md:p-6 md:first:border-l-0"
          >
            <span className="text-sm text-ink-muted">{c.label}</span>
            <CountUp
              to={c.value}
              prefix={c.prefix}
              suffix={c.suffix}
              className="block text-[clamp(2.75rem,1.5rem+4.5vw,6rem)] font-semibold leading-none tracking-[-0.05em] text-ink"
            />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
