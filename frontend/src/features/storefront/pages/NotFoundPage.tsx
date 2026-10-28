import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Seo } from '@/lib/seo';

export function NotFoundPage() {
  return (
    <>
      <Seo title="Page not found" noindex />
      <EmptyState
        illustration="lost"
        className="py-24"
        title="This page has wandered off the pattern"
        description="The link may be old, or the piece may have found a new home. Let's get you back to something lovely."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink to="/">Return home</ButtonLink>
            <ButtonLink to="/shop" variant="secondary">
              Browse the collection
            </ButtonLink>
          </div>
        }
      />
    </>
  );
}

export default NotFoundPage;
