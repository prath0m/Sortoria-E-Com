import { cn } from './cn';

describe('cn', () => {
  it('keeps custom display sizes alongside text colours', () => {
    expect(cn('text-display-2xl', 'text-cream-50')).toBe('text-display-2xl text-cream-50');
    expect(cn('eyebrow text-eyebrow', 'text-gold-300')).toBe('eyebrow text-eyebrow text-gold-300');
  });
  it('still resolves real conflicts', () => {
    expect(cn('text-display-lg', 'text-display-sm')).toBe('text-display-sm');
    expect(cn('text-ink', 'text-burgundy-800')).toBe('text-burgundy-800');
  });
});
