import { CountUp } from '@/components/motion/CountUp';
import { Reveal } from '@/components/motion/Reveal';

export function Counters({ counters }: { counters: { value: number; prefix: string; suffix: string; label: string }[] }) {
  return (
    <section aria-label="Sartoria in numbers" className="grain bg-charcoal-900 text-paper-50">
      <ul className="container-page relative z-[2] grid grid-cols-2 gap-y-10 py-16 text-center md:grid-cols-4 lg:py-20">
        {counters.map((c, i) => (
          <Reveal as="li" key={c.label} delay={i * 0.08}>
            <CountUp to={c.value} prefix={c.prefix} suffix={c.suffix} className="block font-display text-display-xl text-iris-200" />
            <span className="mt-2 block text-xs font-semibold text-paper-200">{c.label}</span>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
