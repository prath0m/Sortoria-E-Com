import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFoundPage } from './NotFoundPage';

export function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <EmptyState
      illustration="error"
      className="min-h-[70vh] justify-center"
      title="A loose thread on our side"
      description="Something didn't load as it should. A refresh usually sets it right; if not, we're already looking into it."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <ButtonLink to="/" variant="secondary">
            Return home
          </ButtonLink>
        </div>
      }
    />
  );
}
