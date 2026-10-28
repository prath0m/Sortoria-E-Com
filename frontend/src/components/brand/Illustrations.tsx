import { cn } from '@/lib/cn';

/**
 * Hand-drawn line illustrations in sage and gold with a burgundy accent, used for empty states,
 * 404 and error pages. Strokes use the palette variables so they follow the theme.
 */
export type IllustrationName = 'thread' | 'bag' | 'heart' | 'search' | 'lost' | 'box' | 'error' | 'letter';

const stroke = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SAGE = 'rgb(var(--sage-500))';
const GOLD = 'rgb(var(--gold-400))';
const WINE = 'rgb(var(--burgundy-800))';

function Leaf({ d, rotate = 0, x = 0, y = 0 }: { d?: string; rotate?: number; x?: number; y?: number }) {
  return (
    <path
      d={d ?? 'M0 0 C 8 -10, 22 -10, 30 0 C 22 10, 8 10, 0 0 Z M0 0 L 30 0'}
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      stroke={SAGE}
      strokeWidth={1.4}
      {...stroke}
    />
  );
}

function Sprig({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s} 1)`}>
      <path d="M0 0 C 10 -20, 14 -40, 10 -64" stroke={SAGE} strokeWidth={1.4} {...stroke} />
      <Leaf x={4} y={-18} rotate={-40} />
      <Leaf x={9} y={-36} rotate={-60} />
      <Leaf x={2} y={-30} rotate={-130} />
      <circle cx={10} cy={-66} r={2.4} fill={GOLD} />
    </g>
  );
}

const scenes: Record<IllustrationName, JSX.Element> = {
  thread: (
    <>
      <circle cx="80" cy="80" r="56" stroke={GOLD} strokeWidth="1.2" {...stroke} strokeDasharray="2 6" />
      <path d="M40 112 L 118 40" stroke={WINE} strokeWidth="2" {...stroke} />
      <ellipse cx="114" cy="44" rx="3" ry="6" transform="rotate(45 114 44)" stroke={WINE} strokeWidth="1.6" {...stroke} />
      <path d="M114 44 C 140 60, 120 100, 92 96 S 58 120, 44 132" stroke={GOLD} strokeWidth="1.4" {...stroke} />
      <Sprig x={34} y={140} />
    </>
  ),
  bag: (
    <>
      <path d="M44 62 H 116 L 110 134 H 50 Z" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M62 62 C 62 36, 98 36, 98 62" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M50 120 H 110" stroke={GOLD} strokeWidth="1.2" {...stroke} />
      <Sprig x={122} y={136} />
      <Sprig x={36} y={136} flip />
    </>
  ),
  heart: (
    <>
      <path
        d="M80 128 C 30 96, 30 52, 58 46 C 70 44, 78 52, 80 60 C 82 52, 90 44, 102 46 C 130 52, 130 96, 80 128 Z"
        stroke={WINE}
        strokeWidth="1.8"
        {...stroke}
      />
      <path d="M58 62 C 52 70, 52 80, 58 88" stroke={GOLD} strokeWidth="1.2" {...stroke} />
      <Sprig x={126} y={138} />
    </>
  ),
  search: (
    <>
      <circle cx="72" cy="72" r="34" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M97 97 L 124 124" stroke={WINE} strokeWidth="3" {...stroke} />
      <path d="M56 64 C 58 56, 66 50, 74 50" stroke={GOLD} strokeWidth="1.4" {...stroke} />
      <Sprig x={34} y={142} flip />
    </>
  ),
  lost: (
    <>
      <path d="M46 40 H 104 L 120 56 V 128 H 46 Z" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M104 40 V 56 H 120" stroke={WINE} strokeWidth="1.4" {...stroke} />
      <path d="M58 76 C 70 70, 82 84, 94 76 S 108 80, 108 80" stroke={GOLD} strokeWidth="1.4" {...stroke} strokeDasharray="3 5" />
      <path d="M58 96 H 96" stroke={SAGE} strokeWidth="1.4" {...stroke} />
      <path d="M58 108 H 84" stroke={SAGE} strokeWidth="1.4" {...stroke} />
      <Sprig x={130} y={142} />
    </>
  ),
  box: (
    <>
      <path d="M40 66 L 80 48 L 120 66 L 80 84 Z" stroke={WINE} strokeWidth="1.6" {...stroke} />
      <path d="M40 66 V 112 L 80 130 L 120 112 V 66" stroke={WINE} strokeWidth="1.6" {...stroke} />
      <path d="M80 84 V 130" stroke={WINE} strokeWidth="1.2" {...stroke} />
      <path d="M60 57 L 100 75" stroke={GOLD} strokeWidth="1.4" {...stroke} />
      <Sprig x={130} y={140} />
    </>
  ),
  error: (
    <>
      <path d="M80 36 L 128 120 H 32 Z" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M80 70 V 96" stroke={GOLD} strokeWidth="2.4" {...stroke} />
      <circle cx="80" cy="108" r="2.6" fill={GOLD} />
      <Sprig x={30} y={146} flip />
    </>
  ),
  letter: (
    <>
      <rect x="36" y="52" width="88" height="62" rx="2" stroke={WINE} strokeWidth="1.8" {...stroke} />
      <path d="M36 54 L 80 88 L 124 54" stroke={WINE} strokeWidth="1.6" {...stroke} />
      <circle cx="80" cy="96" r="7" stroke={GOLD} strokeWidth="1.4" {...stroke} />
      <Sprig x={130} y={140} />
    </>
  ),
};

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={cn('h-32 w-32', className)} aria-hidden="true">
      {scenes[name]}
    </svg>
  );
}

export function BotanicalDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-4 text-sage-400', className)} aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-sage-300 sm:w-28" />
      <svg viewBox="0 0 64 20" className="h-5 w-16">
        <path d="M2 10 H 26" stroke={SAGE} strokeWidth="1" {...stroke} />
        <path d="M38 10 H 62" stroke={SAGE} strokeWidth="1" {...stroke} />
        <path d="M32 3 L 36 10 L 32 17 L 28 10 Z" fill={GOLD} />
        <path d="M24 10 C 20 4, 14 4, 12 8" stroke={SAGE} strokeWidth="1" {...stroke} />
        <path d="M40 10 C 44 16, 50 16, 52 12" stroke={SAGE} strokeWidth="1" {...stroke} />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-sage-300 sm:w-28" />
    </div>
  );
}

/** Large, soft organic shape used behind hero and section headings. */
export function OrganicShape({ className, tone = 'sage' }: { className?: string; tone?: 'sage' | 'gold' | 'burgundy' }) {
  const fill = { sage: 'rgb(var(--sage-200) / .45)', gold: 'rgb(var(--gold-100) / .55)', burgundy: 'rgb(var(--burgundy-50) / .7)' }[tone];
  return (
    <svg viewBox="0 0 600 600" className={cn('pointer-events-none', className)} aria-hidden="true">
      <path
        fill={fill}
        d="M421 72c62 38 117 103 120 172 4 70-45 143-98 205-53 61-111 110-178 107-68-3-145-58-180-128S51 270 79 202c28-69 87-131 158-150 70-19 122 0 184 20z"
      />
    </svg>
  );
}

/** Fine botanical branch line art for section corners. */
export function BotanicalBranch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={cn('pointer-events-none', className)} aria-hidden="true">
      <path d="M4 116 C 60 100, 110 70, 196 8" stroke={SAGE} strokeWidth="1.2" {...stroke} />
      {[30, 62, 94, 126, 158].map((x, i) => (
        <g key={x}>
          <Leaf x={x} y={116 - (x / 196) * 108 - 2} rotate={-70 + i * 4} />
          <Leaf x={x + 10} y={116 - ((x + 10) / 196) * 108} rotate={10 + i * 3} />
        </g>
      ))}
      <circle cx="196" cy="8" r="3" fill={GOLD} />
    </svg>
  );
}
