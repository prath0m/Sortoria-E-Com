import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export function ErrorState({ title = "We couldn't load this.", onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      illustration="search"
      title={title}
      description="Check your connection and try again."
      action={onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}
      className="py-12"
    />
  );
}
