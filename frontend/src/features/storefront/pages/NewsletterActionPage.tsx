import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNewsletterAction } from '@/api/hooks/cms';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/PageLoader';
import { Seo } from '@/lib/seo';

export default function NewsletterActionPage({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const { token = '' } = useParams();
  const mutation = useNewsletterAction(action);
  const { mutate } = mutation;
  useEffect(() => {
    mutate(token);
  }, [mutate, token]);

  if (mutation.isPending || mutation.isIdle) return <PageLoader />;
  const ok = mutation.isSuccess;
  return (
    <>
      <Seo title="Newsletter" noindex />
      <EmptyState
        illustration={ok ? 'letter' : 'error'}
        className="py-24"
        title={
          ok ? (action === 'confirm' ? "You're on the list" : "You've been unsubscribed") : 'That link has expired'
        }
        description={
          ok
            ? action === 'confirm'
              ? 'Thank you. Expect a few considered letters a month, and never more than two a week.'
              : `We won't email ${mutation.data.email} again. You're welcome back any time.`
            : 'Please sign up again from the footer of any page.'
        }
        action={<ButtonLink to="/">Return home</ButtonLink>}
      />
    </>
  );
}
