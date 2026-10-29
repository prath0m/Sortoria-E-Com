import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know our custom font sizes; otherwise `text-display-lg` and a colour like
 * `text-paper-50` look like two colour classes and the size gets dropped.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-sm', 'eyebrow'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
