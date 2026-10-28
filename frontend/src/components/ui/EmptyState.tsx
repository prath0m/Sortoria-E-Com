import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Illustration, type IllustrationName } from '@/components/brand/Illustrations';

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  illustration?: IllustrationName;
  className?: string;
}

export function EmptyState({ title, description, action, illustration = 'thread', className }: EmptyStateProps) {
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center', className)}>
      <Illustration name={illustration} className="mb-6 h-32 w-32" />
      <h2 className="text-display-md">{title}</h2>
      {description ? <p className="mt-3 text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}
