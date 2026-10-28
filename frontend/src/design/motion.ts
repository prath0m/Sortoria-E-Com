/** Shared motion tokens. Only transform and opacity are animated. */
export const ease = {
  luxe: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const duration = { fast: 0.2, base: 0.4, slow: 0.7, slower: 1.2 };

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.luxe } },
};

export const stagger = (step = 0.07) => ({
  hidden: {},
  show: { transition: { staggerChildren: step } },
});
