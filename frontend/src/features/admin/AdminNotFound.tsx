import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminNotFound() {
  return (
    <EmptyState
      illustration="lost"
      title="Nothing here yet"
      description="This page doesn't exist in the admin."
      action={<ButtonLink to="/admin">Back to dashboard</ButtonLink>}
    />
  );
}
