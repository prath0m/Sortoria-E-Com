import { StatusBadge } from '../components/StatusBadge';

const LABEL: Record<string, string> = { live: 'Live', scheduled: 'Scheduled', ended: 'Ended', inactive: 'Off' };
const TONE: Record<string, string> = { live: 'active', scheduled: 'confirmed', ended: 'cancelled', inactive: 'inactive' };

export function StateBadge({ state }: { state: string }) {
  return <StatusBadge status={TONE[state] ?? state} label={LABEL[state] ?? state} />;
}
