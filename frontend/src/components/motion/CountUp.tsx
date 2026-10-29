import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const fmt = new Intl.NumberFormat('en-IN');

/** Counts up from zero the first time it scrolls into view. */
export function CountUp({ to, prefix = '', suffix = '', className }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, to, { duration: 1.8, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce, to]);
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{`${prefix}${fmt.format(to)}${suffix}`}</span>
      <span aria-hidden="true">
        {prefix}
        {fmt.format(value)}
        {suffix}
      </span>
    </span>
  );
}
