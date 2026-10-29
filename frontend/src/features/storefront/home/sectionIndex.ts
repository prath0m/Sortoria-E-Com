import { createContext, useContext } from 'react';

/** The homepage numbers its titled sections "(01)", "(02)"… in admin order; headings read it here. */
export const SectionIndexContext = createContext<number | null>(null);

export function useSectionIndex() {
  const index = useContext(SectionIndexContext);
  return index === null ? null : String(index).padStart(2, '0');
}
